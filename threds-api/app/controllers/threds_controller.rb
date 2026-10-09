class ThredsController < ApplicationController
  include IpRateLimitable

  # replyToId,imageUrl on clientside and snake_case for DB
  def index
    threds = Thred.where(board_type: params[:board_type])
                   .joins(:posts)
                   .group('threds.id')
                   .order('MAX(posts.timestamp) DESC')
    render json: threds.map { |t| serialize_thred(t) }
  end

  def show
    thred = Thred.find(params[:id])
    render json: serialize_thred(thred)
  end

  def create
    return if enforce_post_cooldown!

    now = now_ms

    # The submitted imageUrl is kept in the message while the text rule is
    # checked, so a short post is told the real reason it was refused.
    unless content_words_sufficient_with_image?
      return render json: { error: word_count_error }, status: :unprocessable_entity
    end

    thred = Thred.new(
      id: SecureRandom.uuid,
      board_type: params[:board_type],
      subject: thred_params[:subject],
      timestamp: now
    )

    unless thred.valid?
      return render json: { error: thred.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end

    image_url = upload_image

    if image_url.blank? && image_provided? && !content_words_sufficient_without_image?
      return render json: { error: "Image upload failed. Please try again." }, status: :unprocessable_entity
    end

    # An opening post is a post, so it is validated by the same model rule. The
    # unsaved thred is assigned rather than its id alone, because the
    # `belongs_to` presence check reads the association, not the foreign key.
    post = Post.new(
      id: SecureRandom.uuid,
      thred: thred,
      content: thred_params[:content],
      image_url: image_url,
      timestamp: now
    )

    unless post.valid?
      return render json: { error: post.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end

    Thred.transaction do
      thred.save!

      post.author = "Anonymous"
      post.author_ip = request_ip
      post.save!

      prune_board_threds!
    end

    render json: serialize_thred(thred)
  end

  private

  def thred_params
    params.permit(:board_type, :subject, :content, :imageUrl, :replyToId)
  end

  # An attached file counts as an image even before it has been uploaded, so a
  # short caption alongside an image is allowed.
  def image_provided?
    params[:file].present? || thred_params[:imageUrl].present?
  end

  def content_words_sufficient_without_image?
    thred_params[:content].to_s.split.length >= Post::MINIMUM_WORDS
  end

  def content_words_sufficient_with_image?
    image_provided? || content_words_sufficient_without_image?
  end

  def word_count_error
    "Content must be at least #{Post::MINIMUM_WORDS} words unless an image is attached"
  end

  def upload_image
    if params[:file].present?
      CloudinaryUpload.call(params[:file])
    else
      thred_params[:imageUrl].presence
    end
  end

  # Keep the board at ten threads by dropping whichever one has gone longest
  # without activity.
  def prune_board_threds!
    board_threds = Thred.where(board_type: params[:board_type])
                        .joins(:posts)
                        .group('threds.id')
                        .order('MAX(posts.timestamp) ASC')

    if board_threds.to_a.size > 10
      board_threds.first.destroy
    end
  end

  def serialize_thred(thred)
    {
      id: thred.id,
      boardId: thred.board_type,
      subject: thred.subject,
      timestamp: thred.timestamp,
      posts: thred.posts.order(:timestamp).map do |p|
        {
          id: p.id,
          author: p.author,
          content: p.content,
          timestamp: p.timestamp,
          imageUrl: p.image_url,
          replyToId: p.reply_to_id
        }
      end
    }
  end
end
