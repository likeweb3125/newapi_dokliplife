#!/bin/bash

# 고시원 API 테스트 스크립트
# 사용법: ./test_gosiwon.sh

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbiI6IkFETU4wMDAwMDAwMDAxIiwiYWRtaW5OYW1lIjoiQURNSU4iLCJhZG1pblN0YXR1cyI6IkFDVElWRSIsInNlc3Npb25JRCI6Imw5ZC1ReFFWN3Izdkp1Sl9JVVd5Q0l6TWVPS3d3eVl5IiwiaWQiOiJhZG1pbiIsImxvZ2luVGltZSI6IjIwMjUtMTEtMjRUMDM6MDM6NTcuNTQ0WiIsImlhdCI6MTc2Mzk1MzQzNywiZXhwIjoxNzY0NTU4MjM3LCJhdWQiOiJkb2tsaXBsaWZlLXBhcnRuZXItYXBpIiwiaXNzIjoiZG9rbGlwbGlmZS1wYXJ0bmVyIn0.zzMRrWy4_BTUu-BhsIQWxujAfVI0A-LMPSRnejxKNBw"
URL="http://localhost:5001/v1/gosiwon/info"

echo "🧪 고시원 API 테스트"
echo "===================="
echo ""
echo "📤 요청 정보:"
echo "  URL: $URL"
echo "  Method: POST"
echo "  Search Type: name"
echo "  Search Value: 성수"
echo ""

# 서버 연결 확인
if ! curl -s http://localhost:5001/ > /dev/null 2>&1; then
    echo "❌ 서버가 실행 중이지 않습니다."
    echo "   서버를 먼저 실행해주세요:"
    echo "   - npm start"
    echo "   - 또는 docker-compose up"
    exit 1
fi

echo "✅ 서버 연결 확인됨"
echo ""
echo "📡 API 요청 전송 중..."
echo ""

# API 호출
RESPONSE=$(curl -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"searchType":"name","searchValue":"성수"}' \
  -w "\nHTTP_STATUS:%{http_code}" \
  -s)

# HTTP 상태 코드 추출
HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "📥 응답 결과:"
echo "  HTTP Status: $HTTP_STATUS"
echo ""
echo "  Response Body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ 테스트 성공!"
else
    echo "❌ 테스트 실패 (HTTP Status: $HTTP_STATUS)"
fi

