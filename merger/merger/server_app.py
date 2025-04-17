"""merger: A Flower / PyTorch app."""

from flwr.common import Context, ndarrays_to_parameters
from flwr.server import ServerApp, ServerAppComponents, ServerConfig
from merger.task import Net, get_weights

from flwr.server import ServerConfig, start_server
from flwr.server.strategy import FedAvg
from flower_async.async_strategy import AsynchronousStrategy
from flower_async.async_client_manager import AsyncClientManager
from flower_async.async_server import AsyncServer


# Parameters to customize based on your application
TOTAL_SAMPLES = 10000                # Approx. total number of samples across clients (adjust based on your dataset)
STALENESS_ALPHA = 0.5                # Weighting factor for staleness in FedAsync (between 0 and 1)
FEDASYNC_MIXING_ALPHA = 0.1          # Base learning rate for async updates (FedAsync or AsyncFedED)
FEDASYNC_A = 0.5                     # Staleness scaling parameter for exponential decay (FedAsync)
NUM_CLIENTS = 10                     # Total number of clients you plan to simulate
ASYNC_AGGREGATION_STRATEGY = "fedasync"  # Options: 'unweighted', 'fedasync', 'asyncfeded'
USE_STALENESS = True                  # Whether to penalize stale updates
USE_SAMPLE_WEIGHING = True            # Whether to weight by number of samples
SEND_GRADIENTS = False                # Set True if you're sending gradients instead of weights
SERVER_ARTIFICIAL_DELAY = False       # If there should be a simulated delay for processing


def server_fn(context: Context):
    # Read from config
    num_rounds = context.run_config["num-server-rounds"]
    fraction_fit = context.run_config["fraction-fit"]

    # Initialize model parameters
    ndarrays = get_weights(Net())
    parameters = ndarrays_to_parameters(ndarrays)

    # defining the asynchronous strategy here
    async_strategy = AsynchronousStrategy(
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
        
    config = ServerConfig(num_rounds=num_rounds)
    # creating the async client manager    
    client_manager = AsyncClientManager()
    
    # we are going for the federated average strategy only in here too
    strategy = FedAvg(
        fraction_fit=fraction_fit,
        fraction_evaluate=1.0,
        min_available_clients=2,
        initial_parameters=parameters,
    )    
    
    server = AsyncServer(
        strategy=strategy,
        client_manager=client_manager,
        async_strategy=async_strategy,
        base_conf_dict=base_conf_dict
    )
    
    return ServerAppComponents(strategy=strategy, 
                               config=config,
                               server=server,
                               client_manager=client_manager)


# Create ServerApp
app = ServerApp(server_fn=server_fn)