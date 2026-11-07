class SketchChannel < ApplicationCable::Channel
  def subscribed
    thred = Thred.find_by(id: params[:thread_id])
    return reject unless thred

    stream_from "sketch:#{thred.id}"
  end
end
