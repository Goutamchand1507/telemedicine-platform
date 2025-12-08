import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Paper,
  IconButton,
  Typography,
  Grid,
  Alert,
  Tooltip,
  CircularProgress,
  TextField,
  Badge,
  Drawer,
  List,
  ListItem,
  Divider,
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  CallEnd,
  ScreenShare,
  StopScreenShare,
  Chat as ChatIcon,
  Send,
} from '@mui/icons-material';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

const VideoCall: React.FC = () => {
  const { id: appointmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();

  // Refs for video elements and WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasJoinedCall = useRef<boolean>(false);

  // State
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{id: string, text: string, sender: string, timestamp: Date}>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // ICE servers for WebRTC (STUN/TURN servers for NAT traversal)
  const iceServers = {
    iceServers: [
      // Google's public STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Free TURN server for fallback (helps with restrictive NATs)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  };

  // Initialize media devices
  useEffect(() => {
    const initializeMedia = async () => {
      try {
        console.log('🎥 Requesting media devices...');
        const startTime = performance.now();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,  // Simplified - use default camera settings
          audio: true   // Simplified - use default audio settings
        });

        const elapsed = performance.now() - startTime;
        console.log(`✅ Media devices ready in ${elapsed.toFixed(0)}ms`);

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setIsConnecting(false);
        setIsMediaReady(true);
      } catch (err: any) {
        console.error('❌ Error accessing media devices:', err);
        setError('Failed to access camera/microphone. Please check permissions.');
        setIsConnecting(false);
      }
    };

    initializeMedia();

    return () => {
      // Cleanup on unmount
      console.log('🧹 Cleaning up media devices');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  // Setup WebRTC connection - unified approach
  useEffect(() => {
    console.log('🔍 WebRTC setup check:', {
      hasSocket: !!socket,
      socketConnected: socket?.connected,
      hasStream: !!localStreamRef.current,
      appointmentId: appointmentId,
      userId: user?.id,
      isMediaReady: isMediaReady
    });

    // Basic requirements
    if (!socket || !appointmentId || !user?.id) {
      console.log('⏳ Waiting for socket, appointmentId, or user...');
      return;
    }

    if (!socket.connected) {
      console.log('⏳ Socket not connected yet...');
      return;
    }

    // Wait for media to be ready
    if (!isMediaReady || !localStreamRef.current) {
      console.log('⏳ Waiting for media devices...');
      return;
    }

    // Prevent duplicate setup if already initialized
    if (hasJoinedCall.current) {
      console.log('⚠️ Already initialized, skipping');
      return;
    }

    console.log('🚀 All requirements met, setting up call');
    hasJoinedCall.current = true;

    const createPeerConnection = () => {
      console.log('📡 Creating peer connection');
      const pc = new RTCPeerConnection(iceServers);
      peerConnectionRef.current = pc;

      // Add local stream tracks
      localStreamRef.current?.getTracks().forEach(track => {
        console.log('➕ Adding track:', track.kind);
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📥 Received remote track:', event.track.kind);
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Sending ICE candidate');
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            appointmentId,
          });
        } else {
          console.log('✅ All ICE candidates sent');
        }
      };

      // Handle connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('🔄 ICE connection state:', pc.iceConnectionState);

        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setIsConnected(true);
          setError('');
          console.log('✅ Connection established successfully');
        } else if (pc.iceConnectionState === 'failed') {
          console.error('❌ ICE connection failed');
          setIsConnected(false);
          setError('Connection failed. Please refresh and try again.');

          // Attempt to restart ICE
          pc.restartIce();
        } else if (pc.iceConnectionState === 'disconnected') {
          console.warn('⚠️ ICE connection disconnected, waiting for reconnection...');
          setIsConnected(false);
        } else if (pc.iceConnectionState === 'checking') {
          console.log('🔍 Checking connection...');
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('🔄 Connection state:', pc.connectionState);

        if (pc.connectionState === 'connected') {
          console.log('✅ Peer connection established');
          setError('');
        } else if (pc.connectionState === 'failed') {
          console.error('❌ Peer connection failed');
          setError('Connection failed. Please check your network and try again.');
        } else if (pc.connectionState === 'disconnected') {
          console.warn('⚠️ Peer disconnected');
        }
      };

      // Handle negotiation needed
      pc.onnegotiationneeded = async () => {
        console.log('🔄 Negotiation needed');
      };

      return pc;
    };

    const pc = createPeerConnection();

    // Handle incoming offer
    socket.on('call-offer', async (data: { offer: RTCSessionDescriptionInit, from: string }) => {
      console.log('📨 Received offer from:', data.from);
      try {
        // Check if we already have a remote description
        if (pc.signalingState !== 'stable') {
          console.warn('⚠️ Signaling state is not stable:', pc.signalingState);
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('✅ Set remote description (offer)');

        // Add any pending ICE candidates now that we have remote description
        if (pendingCandidatesRef.current.length > 0) {
          console.log(`🧊 Adding ${pendingCandidatesRef.current.length} pending ICE candidates`);
          for (const candidate of pendingCandidatesRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('❌ Error adding pending ICE candidate:', err);
            }
          }
          pendingCandidatesRef.current = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('📤 Sending answer');
        socket.emit('call-answer', { answer, appointmentId });
      } catch (err) {
        console.error('❌ Error handling offer:', err);
        setError('Failed to establish connection. Please try again.');
      }
    });

    // Handle incoming answer
    socket.on('call-answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      console.log('📨 Received answer');
      try {
        // Only set remote description if we're in the right state
        if (pc.signalingState !== 'have-local-offer') {
          console.warn('⚠️ Cannot set answer, signaling state is:', pc.signalingState);
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('✅ Set remote description (answer)');

        // Add any pending ICE candidates now that we have remote description
        if (pendingCandidatesRef.current.length > 0) {
          console.log(`🧊 Adding ${pendingCandidatesRef.current.length} pending ICE candidates`);
          for (const candidate of pendingCandidatesRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('❌ Error adding pending ICE candidate:', err);
            }
          }
          pendingCandidatesRef.current = [];
        }
      } catch (err) {
        console.error('❌ Error handling answer:', err);
        setError('Failed to complete connection. Please try again.');
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        if (!data.candidate) {
          console.log('📨 Received end-of-candidates signal');
          return;
        }

        if (pc.remoteDescription && pc.remoteDescription.type) {
          // We have a remote description, add candidate immediately
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log('✅ Added ICE candidate');
          } catch (err: any) {
            // Ignore errors for candidates that don't match
            if (err.toString().includes('OperationError')) {
              console.log('⚠️ ICE candidate rejected (this is sometimes normal)');
            } else {
              console.error('❌ Error adding ICE candidate:', err);
            }
          }
        } else {
          // No remote description yet, queue the candidate
          console.log('⏳ Queuing ICE candidate (no remote description yet)');
          pendingCandidatesRef.current.push(data.candidate);
        }
      } catch (err) {
        console.error('❌ Error processing ICE candidate:', err);
      }
    });

    // Handle room joined
    socket.on('room-joined', async (data: { isInitiator: boolean, userId: string }) => {
      console.log('🏠 Joined room. Is initiator:', data.isInitiator);
      // Initiator will create offer when they receive user-joined event
    });

    // Handle user joined (we're already in room, create offer)
    socket.on('user-joined', async (data: { userId: string, userRole: string }) => {
      console.log('👤 Other user joined:', data.userId);

      // Small delay to ensure both peers are ready
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('📤 Creating and sending offer');
      try {
        // Make sure peer connection is in stable state
        if (pc.signalingState !== 'stable') {
          console.warn('⚠️ Peer connection not stable, waiting...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        socket.emit('call-offer', { offer, appointmentId });
        console.log('✅ Offer sent');
      } catch (err) {
        console.error('❌ Error creating offer:', err);
        setError('Failed to initiate connection. Please try again.');
      }
    });

    // Handle user left
    socket.on('user-left', () => {
      console.log('👋 Other user left');
      setIsConnected(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    // Handle chat messages
    socket.on('call-message', (data: { message: string, senderId: string, senderName: string, timestamp: string }) => {
      console.log('💬 Received message:', data);
      const newMsg = {
        id: Date.now().toString(),
        text: data.message,
        sender: data.senderName,
        timestamp: new Date(data.timestamp)
      };
      setMessages(prev => [...prev, newMsg]);

      // Increment unread count if chat is closed
      if (!isChatOpen) {
        setUnreadCount(prev => prev + 1);
      }
    });

    // Join the call room
    socket.emit('join-call', { appointmentId, userId: user?.id });

    return () => {
      console.log('🧹 Cleaning up WebRTC and socket listeners');

      // Leave the call room
      if (socket && appointmentId) {
        socket.emit('leave-call', { appointmentId });
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Remove socket listeners
      socket.off('call-offer');
      socket.off('call-answer');
      socket.off('ice-candidate');
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('call-message');

      // Reset join flag for potential re-mount
      hasJoinedCall.current = false;
    };
  }, [socket, appointmentId, user?.id, isMediaReady]);

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        } as any);

        screenStreamRef.current = screenStream;
        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // Replace the video track being sent to peer
        const sender = peerConnectionRef.current
          .getSenders()
          .find(s => s.track?.kind === 'video');

        if (sender) {
          await sender.replaceTrack(screenVideoTrack);
        }

        // Update local video preview to show screen share
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Handle when user stops sharing via browser UI
        screenVideoTrack.onended = async () => {
          await stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        await stopScreenShare();
      }
    } catch (err: any) {
      console.error('Error toggling screen share:', err);
      if (err.name !== 'NotAllowedError') {
        setError('Failed to share screen');
      }
    }
  };

  // Stop screen sharing helper
  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    const sender = peerConnectionRef.current
      ?.getSenders()
      .find(s => s.track?.kind === 'video');

    if (cameraTrack && sender) {
      await sender.replaceTrack(cameraTrack);
    }

    // Restore local video preview to camera
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsScreenSharing(false);
  };

  // End call
  const endCall = () => {
    if (socket && appointmentId) {
      socket.emit('leave-call', { appointmentId });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    navigate('/appointments');
  };

  // Chat functions
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen) {
      setUnreadCount(0);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !appointmentId) return;

    const messageData = {
      appointmentId,
      message: newMessage,
      senderId: user?.id,
      senderName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'You',
      timestamp: new Date().toISOString()
    };

    // Add to local messages
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: newMessage,
      sender: 'You',
      timestamp: new Date()
    }]);

    // Send to other participants
    socket.emit('call-message', messageData);

    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isConnecting) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Setting up your camera and microphone...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {!isConnected && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Waiting for the other participant to join...
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Remote video (main view) */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ position: 'relative', bgcolor: '#000', aspectRatio: '16/9' }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: isConnected ? 'block' : 'none',
              }}
            />
            {!isConnected && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: 'white',
                }}
              >
                <CircularProgress color="inherit" sx={{ mb: 2 }} />
                <Typography variant="h5">Connecting...</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Check the browser console for connection details
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Local video (small preview) */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ position: 'relative', bgcolor: '#000', aspectRatio: '4/3' }}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.6)',
                px: 1,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              You
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Controls */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mt: 3,
        }}
      >
        <Tooltip title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}>
          <IconButton
            onClick={toggleVideo}
            sx={{
              bgcolor: isVideoOn ? 'primary.main' : 'error.main',
              color: 'white',
              '&:hover': {
                bgcolor: isVideoOn ? 'primary.dark' : 'error.dark',
              },
            }}
          >
            {isVideoOn ? <Videocam /> : <VideocamOff />}
          </IconButton>
        </Tooltip>

        <Tooltip title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}>
          <IconButton
            onClick={toggleAudio}
            sx={{
              bgcolor: isAudioOn ? 'primary.main' : 'error.main',
              color: 'white',
              '&:hover': {
                bgcolor: isAudioOn ? 'primary.dark' : 'error.dark',
              },
            }}
          >
            {isAudioOn ? <Mic /> : <MicOff />}
          </IconButton>
        </Tooltip>

        <Tooltip title={isScreenSharing ? 'Stop sharing' : 'Share screen'}>
          <IconButton
            onClick={toggleScreenShare}
            sx={{
              bgcolor: isScreenSharing ? 'success.main' : 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: isScreenSharing ? 'success.dark' : 'primary.dark',
              },
            }}
          >
            {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Chat">
          <IconButton
            onClick={toggleChat}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }}
          >
            <Badge badgeContent={unreadCount} color="error">
              <ChatIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title="End call">
          <IconButton
            onClick={endCall}
            sx={{
              bgcolor: 'error.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'error.dark',
              },
            }}
          >
            <CallEnd />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Chat Drawer */}
      <Drawer
        anchor="right"
        open={isChatOpen}
        onClose={toggleChat}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100%',
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Chat</Typography>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <List>
              {messages.map((msg) => (
                <ListItem
                  key={msg.id}
                  sx={{
                    flexDirection: 'column',
                    alignItems: msg.sender === 'You' ? 'flex-end' : 'flex-start',
                    mb: 1,
                  }}
                >
                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '80%',
                      bgcolor: msg.sender === 'You' ? 'primary.main' : 'grey.200',
                      color: msg.sender === 'You' ? 'white' : 'text.primary',
                    }}
                  >
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}>
                      {msg.sender}
                    </Typography>
                    <Typography variant="body2">{msg.text}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Paper>
                </ListItem>
              ))}
              <div ref={chatEndRef} />
            </List>
          </Box>

          <Divider />

          <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              multiline
              maxRows={3}
            />
            <IconButton
              color="primary"
              onClick={sendMessage}
              disabled={!newMessage.trim()}
            >
              <Send />
            </IconButton>
          </Box>
        </Box>
      </Drawer>
    </Container>
  );
};

export default VideoCall;
