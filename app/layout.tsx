import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Peer feedback app',
    description: 'Collaborative essay assessment platform with AI-powered feedback',
}

import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'sonner'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
                <Toaster position="top-center" richColors />
            </body>
        </html>
    )
}
