#!/bin/bash

# Telemedicine Platform API Test Script

API_URL="https://telemedicine-platform-production.up.railway.app"

echo "================================"
echo "Testing Telemedicine Platform API"
echo "================================"
echo ""

# Test 1: Health Check
echo "1. Testing Health Endpoint..."
curl -s "$API_URL/health" | jq '.'
echo ""
echo ""

# Test 2: Register Patient
echo "2. Testing Patient Registration..."
PATIENT_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient'$(date +%s)'@test.com",
    "password": "Test123!@#",
    "confirmPassword": "Test123!@#",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "1234567890",
    "role": "patient"
  }')
echo "$PATIENT_RESPONSE" | jq '.'
PATIENT_TOKEN=$(echo "$PATIENT_RESPONSE" | jq -r '.token // empty')
echo ""

# Test 3: Register Doctor
echo "3. Testing Doctor Registration..."
DOCTOR_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor'$(date +%s)'@test.com",
    "password": "Test123!@#",
    "confirmPassword": "Test123!@#",
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "9876543210",
    "role": "doctor",
    "specialization": "General Practice",
    "consultationFee": 100
  }')
echo "$DOCTOR_RESPONSE" | jq '.'
DOCTOR_TOKEN=$(echo "$DOCTOR_RESPONSE" | jq -r '.token // empty')
echo ""

# Test 4: Login
if [ -n "$PATIENT_TOKEN" ]; then
  echo "4. Testing Login..."
  curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "patient@test.com",
      "password": "Test123!@#"
    }' | jq '.'
  echo ""
fi

# Test 5: Get Doctors (requires auth)
if [ -n "$PATIENT_TOKEN" ]; then
  echo "5. Testing Get Doctors..."
  curl -s "$API_URL/api/users/doctors" \
    -H "Authorization: Bearer $PATIENT_TOKEN" | jq '.'
  echo ""
fi

echo ""
echo "================================"
echo "Testing Complete!"
echo "================================"
