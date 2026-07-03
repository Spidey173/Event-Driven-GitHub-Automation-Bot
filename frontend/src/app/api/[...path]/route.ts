import { NextRequest, NextResponse } from 'next/server';

async function handleProxy(req: NextRequest, method: string) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  
  const url = new URL(req.url);
  const path = url.pathname;
  const search = url.search;
  
  const destinationUrl = `${backendUrl}${path}${search}`;
  
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });

  let body: any = undefined;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    try {
      body = await req.text();
    } catch (e) {
      // Body reading empty or failed
    }
  }

  try {
    const backendRes = await fetch(destinationUrl, {
      method,
      headers,
      body,
      redirect: 'manual', // Allow client browser to receive and process redirects directly
      cache: 'no-store'
    });

    const responseHeaders = new Headers();
    backendRes.headers.forEach((value, key) => {
      // Forward all response headers, especially 'Set-Cookie'
      responseHeaders.append(key, value);
    });

    // Handle HTTP Redirects (3xx)
    if (backendRes.status >= 300 && backendRes.status < 400) {
      return new NextResponse(null, {
        status: backendRes.status,
        headers: responseHeaders
      });
    }

    const responseBody = await backendRes.arrayBuffer();
    return new NextResponse(responseBody, {
      status: backendRes.status,
      headers: responseHeaders
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: `API Gateway Proxy Error: ${err.message}` },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleProxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return handleProxy(req, 'POST');
}

export async function PUT(req: NextRequest) {
  return handleProxy(req, 'PUT');
}

export async function DELETE(req: NextRequest) {
  return handleProxy(req, 'DELETE');
}

export async function PATCH(req: NextRequest) {
  return handleProxy(req, 'PATCH');
}
