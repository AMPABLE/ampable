# Use a lightweight web server image
FROM nginx:alpine

# Copy your web folder into the web server's directory
COPY . /usr/share/nginx/html

# Expose port 80 for web traffic
EXPOSE 80

# Start the Nginx server
CMD ["nginx", "-g", "daemon off;"]
