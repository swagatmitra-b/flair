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
    base_url="http://localhost:4000/repo/hash/ad23af18-d7c0-4f53-bf7e-786122dc4055/branch/hash/893c6cef-4dca-49ec-b60f-af1178cb48ef/commit/sharedFolder",
    auth_header_value="Bearer universalDUwyw8WeSjJEYakMs1TqzvXNLywawkZmZ4Vay5MLG7Tr.5NMoEhEW1x6PHYesTtAECFTAauwZb5gg128GQiUqykTdskjR7zBJ3BRqTcg7NkbPPwLErBkJnWTJA8vUqCvxrBfJkihAL7DueSy3QwZRtpJ54hS3FkcqDN1qZVWePXrZxcwVubUPwvZBpCMRWR4PkPqBgepi8PptsQLtvG2UXKztGQitfH7fvuNaMCnWfejBa9fsoU3ZhvaXGeUg48iv1Ki2wa2WNYtdAK6haXVamGRF6LsuZwLhMDTdT6i1fwZ5c4mWx1RrqJ4DMYr5KAB71NLepmBA1dzFTow8BJzRm1wppqY5ihJtuujzM4RnemcTBphMnDYqfu4x2M7n54tx1zGmfNCdjKzZKnPzUoRT9ZCqqLGnAtfWAqhn6dfLhrqTiKv6vasa8oMN1pYjtYSQqmgrdX9bQkiv2LiU6cBMGwtqmgpHzpBxSiioG87wYBrgH1iDVjH4vwLsDrJs78gueQ1ab8tBwisSfQ9tPLjYS1FzapKP6KHPGwt9LCHJ5NvrV2yuuFv1deddHNa8RyGRNB4zfRHYmCHGoshSHsNunxrxdzdQu6LtY6eWZYqRuntoxyHvt5QggAjAzpncQ9UrjuiuGLePunkgCXsc361HMh3frtW9PRESeihTvZLF8B36oBtjNAzBtNFuC6x4nGQHZr2whsAGevU4jbVbTtLVWbiDMR6vgSCcbtNPadEXGysxxQKfKk94uRPLQmce341Y3HYhdLoGpyf4egv3s6MX2H4magCiMavdf.4ZdnDN58y4w9y7ZAA5acZB9nk4BGosqM7BkMYADNVrGakTKN5YpgMpTXxkqWXALJx1EeVZyV9nhxmBgr3AXzm69M"    
)
node = AsyncFederatedNode(strategy=strategy, 
                          shared_folder=shared_folder,
                          node_id="DUwyw8WeSjJEYakMs1TqzvXNLywawkZmZ4Vay5MLG7Tr")

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