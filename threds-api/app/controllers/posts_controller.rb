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
end