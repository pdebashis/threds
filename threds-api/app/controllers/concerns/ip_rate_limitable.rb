# Blocks posts that arrive too soon after the previous post from the same IP.
#
# This is a deliberate second layer behind Rack::Attack: Rack::Attack keeps its
# counters in Rails.cache, which is per-process memory in production, so its
# limits are best-effort and reset on every deploy. The check here reads the
# database, so it survives restarts and cannot be reset by a client.
#
# Include this in controllers that create posts and call `enforce_post_cooldown!`
# before persisting. It renders the 429 itself and returns true when the request
# was refused.
module IpRateLimitable
  extend ActiveSupport::Concern

  # Seconds a client must wait between two consecutive posts.
  POST_COOLDOWN = 30.seconds

  private

  def enforce_post_cooldown!
    return false if request_ip.blank?

    last_post = Post.where(author_ip: request_ip).order(timestamp: :desc).first
    return false if last_post.nil?

    elapsed_ms = now_ms - last_post.timestamp.to_i
    return false if elapsed_ms >= POST_COOLDOWN.in_milliseconds

    retry_after = ((POST_COOLDOWN.in_milliseconds - elapsed_ms) / 1000.0).ceil

    response.set_header("Retry-After", retry_after.to_s)
    render json: {
      error: "You are posting too quickly. Please wait #{retry_after} #{'second'.pluralize(retry_after)} before posting again."
    }, status: :too_many_requests

    true
  end

  def request_ip
    request.remote_ip
  end

  # Millisecond timestamp used both for cooldown maths and for the values stored
  # in `threds.timestamp` / `posts.timestamp`, which are bigints of epoch millis.
  def now_ms
    (Time.now.to_f * 1000).to_i
  end
end
