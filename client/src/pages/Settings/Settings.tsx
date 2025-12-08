import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";

// FIX: Making this file a module (required for TypeScript)
export {};

const Settings: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Settings
          </Typography>

          <Typography variant="body1" color="text.secondary">
            This is your settings page.  
            You can add notification settings, password changes, theme settings, etc.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings;
