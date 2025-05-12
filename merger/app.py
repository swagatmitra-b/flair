# Import necessary libraries
import pickle
import tensorflow as tf
from tensorflow import keras
from flwr.server.strategy import FedAvg  # Federated strategy
from flwr_serverless import AsyncFederatedNode
from flwr_serverless.keras import FlwrFederatedCallback

from lib.shared_folder_http import SharedFolderHTTPAuth

# Define the federated learning strategy and shared folder
strategy = FedAvg()
shared_folder = SharedFolderHTTPAuth(
    base_url="http://localhost:4000/repo/hash/5345c1b8-49ff-4ece-8bdd-c44a8d7701ce/branch/hash/a8d2f74a-8a76-450d-9baf-fbd3808c38fc/commit/sharedFolder",
    auth_header_value="Bearer universalDzpefiVYkPED7Kbit6fWRiXQ1zSmBy17AN15NVTx1tcd.5NMoEhEW1x6PHYesTtAECFTAauwZb5gg128GQiUqykTdskjR7zBJ3BRqTcg7NkbPPwLErBkJnWTJA8vUqCvxrBgbFUu1nQ4bzCeLmmLoFCCWFCB9EU6dD3Tde7W6VJxjQSvQYKeeCoepJPY1HPN12Et1MJ9KB5775rcdGfE6qgTGzQ3FfMZZDGuRSw5Taik6ph5r5txt1LzR99aL8xUehRU1ry2Q6AWLe84Qh7aAGAaiQEHuQYDMrcN5vRWMYLj5q316bSpzP8vS4cVKaPceob4AEwcDCSwDcT4pSLx8PorRDq9At5Z73EUiHaEEgxbCyQP4VxrjPCnCWy9zzwfzD777ZksR7ZkzeHE88sN2mQRS4wLfZFKbYhEkR8HG424YhEsQnuAh9hofbPNkZPjaoiPuyjofCvKHMYsLqHJD5VYSRjvkQ8U5XwkN8hjVW1cbArBxa8Bd1wV7QPYznpiD11J8hVYSv7bosqW6F7qPkSfhopAink4Uu6KqpEWWcBqwjC1XtKxSYkLgBrsUKnFnQjY6abJYiVX5vArxGVzahiThGS8gJU4jttfonVsQ2gTqePf2Atmc1kXe6nSGJuWBXoKcSRoCNuFMnVMWQLS1oXvJJdpzyyJT5mN85uMb89iQmid8TwmCnhWN9EeQ1Z7ifoik54FH61CdJuwWGoVtd36rASZtdJ5cSqzf7s4Jwm25WLSYMduQGCeNFiXDWhRt9vCRUbv7XeMTnLqt5wRQVxymEYGxAz5wf.QZkPMJ3UwXPBCErTXqbY4icXEvV58ggY1Vea3gJCZnWs9Wvpd1rCn9j24MZpdkjKy8Na2bDtBNePaH6Xht8oGBa"
)
node = AsyncFederatedNode(strategy=strategy, 
                          shared_folder=shared_folder,
                          node_id="DzpefiVYkPED7Kbit6fWRiXQ1zSmBy17AN15NVTx1tcd")

# Define dataset and model parameters
batch_size = 32
dataset = tf.data.Dataset.from_tensor_slices((tf.random.normal([1000, 28, 28]), tf.random.uniform([1000], maxval=10, dtype=tf.int32)))
dataset = dataset.batch(batch_size)

steps_per_epoch = len(dataset)  # Calculate steps per epoch based on dataset size and batch size
num_examples_per_epoch = steps_per_epoch * batch_size  # Number of examples used in each epoch

# Define the federated callback
callback = FlwrFederatedCallback(
    node,
    num_examples_per_epoch=num_examples_per_epoch,  
    save_model_before_aggregation=False,                    # skip per client snapshots
    override_metrics_with_aggregated_metrics=False,         # keep both local and global metrics
    save_model_after_aggregation=False,                      # persist global model each round
)

# Define and compile the model
model = keras.Sequential([
    keras.layers.Flatten(input_shape=(28, 28)),
    keras.layers.Dense(128, activation='relu'),
    keras.layers.Dense(10, activation='softmax')
])
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])

# Train the model using the federated callback
model.fit(dataset, epochs=5, callbacks=[callback])