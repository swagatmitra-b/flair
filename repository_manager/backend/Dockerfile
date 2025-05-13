FROM node:22.14

# FROM node:22.14-alpine3.16
# RUN apk add --no-cache openssl1.1-compat

WORKDIR /usr/app

# Set default environment variables
ENV PORT=4000
ENV HOST=127.0.0.1
ENV DATABASE_URL="mongodb+srv://flair:flairaiapp@flair.bbz4gta.mongodb.net/flair"

# Install OpenSSL (required by Prisma on alpine)
# RUN apk add --no-cache openssl1.1-compat

# Copy package files
COPY package.json .
COPY package-lock.json .

# Install dependencies using npm
RUN npm install

# Copy the rest of the source code
COPY . .

# Generate the Prisma Client (make sure your schema.prisma includes the proper binaryTargets)
RUN npx prisma generate

# Build the app (compiles TypeScript to JavaScript in your 'build' directory as per tsconfig.json)
RUN npm run build

# Expose the application's port
EXPOSE 4000

# Start the app
CMD ["npm", "start"]
