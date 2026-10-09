class PostsController < ApplicationController
  include IpRateLimitable

  skip_before_action :verify_authenticity_token, raise: false

  # replyToId,imageUrl on clientside and snake_case for DB
  def create
    thred = Thred.find(params[:id])

    if thred.posts.count >= 101
      return render json: { error: "thred limit reached" }, status: :unprocessable_entity
    end

    return if enforce_post_cooldown!

    # The word-count rule is decided by text before anything is uploaded, so a
    # rejected reply never spends a Cloudinary upload.
    unless content_words_sufficient?
      return render json: { error: word_count_error }, status: :unprocessable_entity
    end

    image_url = upload_image

    # A supplied image that could not be stored leaves a short caption with
    # nothing to lean on. Report the upload rather than a misleading word-count
    # error.
    if image_url.blank? && image_provided? && !content_words_sufficient_without_image?
      return render json: { error: "Image upload failed. Please try again." }, status: :unprocessable_entity
    end

    post = thred.posts.new(
      id: SecureRandom.uuid,
      content: post_params[:content],
      author: "Anonymous",
      timestamp: now_ms,
      reply_to_id: post_params[:replyToId],
      image_url: image_url,
      author_ip: request_ip
    )

    unless post.valid?
      return render json: { error: post.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end

    post.save!

    render json: {
      id: post.id,
      author: post.author,
      content: post.content,
      timestamp: post.timestamp,
      imageUrl: post.image_url,
      replyToId: post.reply_to_id
    }
  end

  def report
    post = Post.find(params[:id])
    reason = report_reason
    custom_reason = report_custom_reason

    if reason.blank?
      return render json: { error: "Report reason is required" }, status: :unprocessable_entity
    end

    allowed_reasons = %w[inappropriate off_topic shitpost custom]
    unless allowed_reasons.include?(reason)
      return render json: { error: "Invalid report reason" }, status: :unprocessable_entity
    end

    final_reason = reason == "custom" ? (custom_reason.presence || "custom") : reason

    reported_post = ReportedPost.create!(
      id: SecureRandom.uuid,
      thred_id: post.thred_id,
      post_id: post.id,
      post_content: post.content,
      report_reason: final_reason,
      custom_reason: reason == "custom" ? custom_reason.presence : nil,
      reported_at: Time.current
    )

    render json: {
      id: reported_post.id,
      thredId: reported_post.thred_id,
      postId: reported_post.post_id,
      postContent: reported_post.post_content,
      reportReason: reported_post.report_reason,
      customReason: reported_post.custom_reason,
      reportedAt: reported_post.reported_at.iso8601
    }, status: :created
  end

  private

  def post_params
    params.permit(:content, :imageUrl, :replyToId)
  end

  def upload_image
    if params[:file].present?
      CloudinaryUpload.call(params[:file])
    else
      post_params[:imageUrl].presence
    end
  end

  # An attached file counts as an image even before it has been uploaded, so a
  # short caption alongside an image is allowed.
  def image_provided?
    params[:file].present? || post_params[:imageUrl].present?
  end

  def content_words_sufficient?
    return true if image_provided?

    content_words_sufficient_without_image?
  end

  def content_words_sufficient_without_image?
    post_params[:content].to_s.split.length >= Post::MINIMUM_WORDS
  end

  def word_count_error
    "Content must be at least #{Post::MINIMUM_WORDS} words unless an image is attached"
  end

  def report_reason
    (params[:reason] || params[:report_reason] || params[:reportReason]).to_s.strip
  end

  def report_custom_reason
    (params[:custom_reason] || params[:customReason]).to_s.strip
  end
end
