class PostsController < ApplicationController
  skip_before_action :verify_authenticity_token, raise: false

  # replyToId,imageUrl on clientside and snake_case for DB
  def create
    thred = Thred.find(params[:id])

    if thred.posts.count >= 101
      return render json: { error: "thred limit reached" }, status: :unprocessable_entity
    end

    # Upload image to Cloudinary if provided
    image_url = nil
    if params[:file].present?
      image_url = CloudinaryUpload.call(params[:file])
    elsif params[:imageUrl].present?
      image_url = params[:imageUrl]
    end

    post = thred.posts.create!(
      id: SecureRandom.uuid,
      content: params[:content],
      author: "Anonymous",
      timestamp: (Time.now.to_f * 1000).to_i,
      reply_to_id: params[:replyToId],
      image_url: image_url
    )

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
    reason = (params[:reason] || params[:report_reason] || params[:reportReason]).to_s.strip
    custom_reason = (params[:custom_reason] || params[:customReason]).to_s.strip

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
end