# Configure Rack::Attack as the outer, cheap rate limit.
#
# Rack::Attack keys off `req.ip`, which resolves the real client only when the
# reverse proxy forwards client addresses. The AWS deploy runs Caddy in front of
# Puma; Caddy v2 sets `X-Forwarded-For` by default and Rails' RemoteIp middleware
# reads it, so this holds. If the proxy ever stops forwarding, every request
# collapses to a single IP and these limits become global rather than per client.
#
# This layer is best-effort: counters live in Rails.cache, so limits reset on
# deploy. `IpRateLimitable#enforce_post_cooldown!` provides the durable backstop.

# Throttle thread creation: max 3 threads per IP per hour
Rack::Attack.throttle('threds/create', limit: 3, period: 1.hour) do |req|
  if req.post? && req.path.match?(%r{^/boards/[^/]+/threds$})
    req.ip
  end
end

# Throttle reply creation: max 5 posts per IP per minute in a thred
Rack::Attack.throttle('posts/create', limit: 5, period: 1.minute) do |req|
  if req.post? && req.path.match?(%r{^/threds/[^/]+/posts$})
    req.ip
  end
end

# Throttle uploads: max 20 per IP per hour.
# Uploads bill against the Cloudinary account, so they are capped even though a
# rejected post never reaches the uploader.
Rack::Attack.throttle('uploads/create', limit: 20, period: 1.hour) do |req|
  req.ip if req.post? && req.path == '/upload'
end

# Skip rate limiting for requests from localhost (development)
Rack::Attack.safelist('allow from localhost') do |req|
  req.ip == '127.0.0.1' || req.ip == '::1'
end

# Handle rate limited requests
Rack::Attack.throttled_responder = lambda { |_env|
  [
    429,
    {
      'Content-Type' => 'application/json',
      'Retry-After' => '60'
    },
    [{ error: 'Rate limit exceeded. Please slow down and try again shortly.' }.to_json]
  ]
}

# Note: Rack::Attack counts in the default cache store (in-process memory here),
# so these counters are wiped by any deploy or restart. That is acceptable for
# the per-minute burst limits; the durable per-IP backstop is
# `IpRateLimitable#enforce_post_cooldown!`, which reads the database.
Rails.application.config.middleware.use Rack::Attack
