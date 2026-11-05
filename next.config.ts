import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@grpc/grpc-js", "@protobuf-ts/grpc-transport"],
};

export default nextConfig;
