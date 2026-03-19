# Configure Rack::Attack for rate limiting

# Throttle board creation: max 3 boards per IP per hour
Rack::Attack.throttle('boards/create', limit: 3, period: 1.hour) do |req|
  if req.post? && req.path.start_with?('/boards/')
    req.ip
  end
end

# Throttle post creation: max 5 posts per IP per minute in a thred
Rack::Attack.throttle('posts/create', limit: 5, period: 1.minute) do |req|
  if req.post? && req.path.match?(%r{^/threds/[^/]+/posts$})
    req.ip
  end
end

# Skip rate limiting for requests from localhost (development)
Rack::Attack.safelist('allow from localhost') do |req|
  req.ip == '127.0.0.1' || req.ip == '::1'
end

# Handle rate limited requests
Rack::Attack.throttled_responder = lambda { |env|
  [
    429, # HTTP status code
    { 'Content-Type' => 'application/json' },
    [{ error: 'Rate limit exceeded. Maximum 3 boards per hour per IP.' }.to_json]
  ]
}

# Add Rack::Attack to the middleware stack
Rails.application.config.middleware.use Rack::Attack
