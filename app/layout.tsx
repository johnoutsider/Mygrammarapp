import type { Metadata } from 'next'
import { Inter, Irish_Grover } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })
const irishGrover = Irish_Grover({
    weight: '400',
    subsets: ['latin'],
    variable: '--font-irish-grover',
})

export const metadata: Metadata = {
    title: 'Peer feedback app',
    description: 'Collaborative essay assessment platform with AI-powered feedback',
}

import { ThemeProvider } from '@/components/ThemeProvider'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} ${irishGrover.variable}`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
            </body>
        </html>
    )
}
