class ThredsController < ApplicationController
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
    id = SecureRandom.uuid
    now = (Time.now.to_f * 1000).to_i

    thred = Thred.create!(
      id: id,
      board_type: params[:board_type],
      subject: params[:subject],
      timestamp: now
    )

    # Upload image to Cloudinary if provided
    image_url = nil
    if params[:file].present?
      image_url = CloudinaryUpload.call(params[:file])
    elsif params[:imageUrl].present?
      image_url = params[:imageUrl]
    end

    thred.posts.create!(
        id: SecureRandom.uuid,
        content: params[:content],
        author: "Anonymous",
        timestamp: now,
        image_url: image_url
   )

    # Remove the least active thread if more than 10 threads exist
    board_threds = Thred.where(board_type: params[:board_type])
                         .joins(:posts)
                         .group('threds.id')
                         .order('MAX(posts.timestamp) ASC')
    
    if board_threds.to_a.size > 10
      least_active_thred = board_threds.first
      least_active_thred.destroy
    end

    render json: serialize_thred(thred)
  end

  private

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
