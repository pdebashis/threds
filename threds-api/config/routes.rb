Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  get  "/boards/:board_type/threds", to: "threds#index"
  post "/boards/:board_type/threds", to: "threds#create"

  get  "/threds/:id", to: "threds#show"
  post "/threds/:id/posts", to: "posts#create"
  post "/posts/:id/report", to: "posts#report"

  get    "/grid/items", to: "grid#index"
  post   "/grid/items", to: "grid#create"
  get    "/grid/items/:item_id", to: "grid#show"
  get    "/grid/items/:item_id/cells", to: "grid#cells"
  get    "/grid/items/:item_id/cells/:row/:column", to: "grid#cell"
  post   "/grid/items/:item_id/cells/:row/:column/posts", to: "grid#create_post"
  patch  "/grid/items/:item_id/cells/:row/:column/format", to: "grid#update_format"
  
  post "/upload", to: "uploads#create"
  # Defines the root path route ("/")
  # root "posts#index"
end
