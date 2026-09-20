/** @type {import('next').NextConfig} */
module.exports = { reactStrictMode: true, webpack: (c) => { c.resolve.fallback = { ...c.resolve.fallback, fs: false, canvas: false }; return c; } };
