/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    typescript: {
        // Warning: This allows production builds to successfully complete even if
        // your project has TypeScript errors.
        ignoreBuildErrors: true,
    },
    async rewrites() {
        return [
            {
                source: '/student/speaking/results/guided-:submissionId',
                destination: '/student/speaking/results/guided/:submissionId',
            },
            {
                source: '/teacher/speaking/logs/:studentId/guided-:submissionId',
                destination: '/teacher/speaking/logs/:studentId/guided/:submissionId',
            },
        ]
    },
}

module.exports = nextConfig
