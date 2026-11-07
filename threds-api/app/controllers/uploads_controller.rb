class UploadsController < ApplicationController
  skip_before_action :verify_authenticity_token, raise: false

  def create
    # Use the key sent by your TSX frontend (e.g., params[:url] or params[:file])
    input_data = params[:file] || params[:url]

    if input_data.blank?
      return render json: { error: "No data provided" }, status: :bad_request
    end

    if params[:file].present? && (validation_error = CloudinaryUpload.validation_error(params[:file]))
      return render json: { error: validation_error }, status: :unprocessable_entity
    end

    image_url = CloudinaryUpload.call(input_data)

    if image_url.present?
      render json: { imageUrl: image_url }, status: :ok
    else
      render json: { error: "Upload failed" }, status: :unprocessable_entity
    end
  end
end