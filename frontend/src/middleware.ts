import { asyncWrapProviders } from "async_hooks";
import { getToken } from "next-auth/jwt";
import { useSession } from "next-auth/react";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

// // // This function can be marked `async` if using `await` inside
// // export async function middleware(request: NextRequest) {
// //   const token = await getToken({
// //     req: request,
// //     secret: process.env.NEXTAUTH_SECRET,
// //   });

// //   const { pathname } = request.nextUrl;

// //   const isAuthPage = pathname.endsWith("/login");
// //   const isprotected =
// //     pathname.startsWith("/dashboard") || pathname.startsWith("/interview");

// //     console.log("Pathname :",pathname);
    

// //   if (!token && isprotected) {
// //     const loginUrl = new URL("/login", request.url);
// //     loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

// //     return NextResponse.redirect(loginUrl);
// //   }

// //   if (token && isAuthPage) {
// //     return NextResponse.redirect(new URL("/dashboard", request.url));
// //   }

// //   return NextResponse.next()
// // }

// // // See "Matching Paths" below to learn more
// // export const config = {
// //   matcher: ["/login", "/dashboard/:path*", "/interview/:path*"],
// // };

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ✅ Allow NextAuth API routes to pass through untouched
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const isAuthPage = pathname.startsWith('/login')
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/interview')

  if (!token && isProtected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (token && isAuthPage) {
    return NextResponse.redirect(
      new URL('/dashboard', request.url)
    )
  }

  return NextResponse.next()
}

// // See "Matching Paths" below to learn more
export const config = {
  matcher: ["/login", "/dashboard/:path*", "/interview/:path*"],
};
