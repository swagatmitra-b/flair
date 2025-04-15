from flwr.server.strategy import FedAvg
from flower_async.async_strategy import AsynchronousStrategy
from flower_async.async_client_manager import AsyncClientManager
from flower_async.async_server import AsyncServer

# Parameters to customize based on your application
TOTAL_SAMPLES = 10000                 # Approx. total number of samples across clients (adjust based on your dataset)
STALENESS_ALPHA = 0.5                # Weighting factor for staleness in FedAsync (between 0 and 1)
FEDASYNC_MIXING_ALPHA = 0.1          # Base learning rate for async updates (FedAsync or AsyncFedED)
FEDASYNC_A = 0.5                     # Staleness scaling parameter for exponential decay (FedAsync)
NUM_CLIENTS = 10                     # Total number of clients you plan to simulate
ASYNC_AGGREGATION_STRATEGY = "fedasync"  # Options: 'unweighted', 'fedasync', 'asyncfeded'
USE_STALENESS = True                # Whether to penalize stale updates
USE_SAMPLE_WEIGHING = True          # Whether to weight by number of samples
SEND_GRADIENTS = False              # Set True if you're sending gradients instead of weights
SERVER_ARTIFICIAL_DELAY = 0.0       # Simulated delay (in seconds) for processing, set >0 to test resilience

# Initialize the customized strategy
strategy = AsynchronousStrategy(
    total_samples=TOTAL_SAMPLES,
    staleness_alpha=STALENESS_ALPHA,
    fedasync_mixing_alpha=FEDASYNC_MIXING_ALPHA,
    fedasync_a=FEDASYNC_A,
    num_clients=NUM_CLIENTS,
    async_aggregation_strategy=ASYNC_AGGREGATION_STRATEGY,
    use_staleness=USE_STALENESS,
    use_sample_weighing=USE_SAMPLE_WEIGHING,
    send_gradients=SEND_GRADIENTS,
    server_artificial_delay=SERVER_ARTIFICIAL_DELAY
)

base_conf_dict = {
    "client_local_delay": False,
    "dataset_seed": 42,
    "data_loading_strategy": "fixed_nr",
    "n_last_samples_for_data_loading_fit": 100
}

# Launch server with async support
server = AsyncServer(
    client_manager=AsyncClientManager(),
    strategy=FedAvg(),  # If your AsynchronousStrategy wraps FedAvg logic internally, keep this as is
    async_strategy=strategy,
    base_conf_dict=base_conf_dict
)

history = server.fit(num_rounds=5, timeout=60)
