# merger for Flair: based on the async flower server wrapper
# Debashish Buragohain

from flwr.common import Context, ndarrays_to_parameters
from flwr.server import ServerApp, ServerAppComponents, ServerConfig
from merger.task import Net, get_weights

from flwr.server import ServerConfig, start_server
from flwr.server.strategy import FedAvg
from merger.flower_async.async_strategy import AsynchronousStrategy
from merger.flower_async.async_client_manager import AsyncClientManager
from merger.flower_async.async_server import AsyncServer

# Parameters to customize based on your application
# TOTAL_SAMPLES = 10000                # Approx. total number of samples across clients (adjust based on your dataset)
# STALENESS_ALPHA = 0.5                # Weighting factor for staleness in FedAsync (between 0 and 1)
# FEDASYNC_MIXING_ALPHA = 0.3          # Base learning rate for async updates (FedAsync or AsyncFedED): Aggressive model mixing
# FEDASYNC_A = 0.5                     # Staleness scaling parameter for exponential decay (FedAsync)
# NUM_CLIENTS = 10                     # Total number of clients you plan to simulate
# ASYNC_AGGREGATION_STRATEGY = "fedasync"  # Options: 'unweighted', 'fedasync', 'asyncfeded'
# USE_STALENESS = True                  # Whether to penalize stale updates
# USE_SAMPLE_WEIGHING = True            # Whether to weight by number of samples
# SEND_GRADIENTS = False                # Set True if you're sending gradients instead of weights
# SERVER_ARTIFICIAL_DELAY = False       # If there should be a simulated delay for processing

def server_fn(context: Context):
    # Configuration parameters (previously suggested for base.yaml)
    total_train_time = 86400  # 24 hours in seconds
    num_clients = 100
    client_local_delay = False
    
    # Existing parameter setup
    num_rounds = context.run_config["num-server-rounds"]
    fraction_fit = context.run_config["fraction-fit"]

    # Initialize model parameters
    ndarrays = get_weights(Net())
    parameters = ndarrays_to_parameters(ndarrays)

    # Async strategy configuration
    async_strategy = AsynchronousStrategy(
        total_samples=50000,  # CIFAR-10 total samples
        staleness_alpha=0.5,
        fedasync_mixing_alpha=0.3,
        fedasync_a=0.5,
        num_clients=num_clients,
        async_aggregation_strategy="fedasync",
        use_staleness=True,
        use_sample_weighing=True,
        send_gradients=False,
        server_artificial_delay=False
    )

    # Server configuration
    base_conf_dict = {
        "client_local_delay": client_local_delay,
        "dataset_seed": 42,
        "data_loading_strategy": "fixed_nr",
        "n_last_samples_for_data_loading_fit": 100,
        "is_streaming": False,
        "total_train_time": total_train_time  # Add this line
    }

    # Rest of your existing server setup
    config = ServerConfig(num_rounds=num_rounds)
    client_manager = AsyncClientManager()
    
    strategy = FedAvg(
        fraction_fit=1.0,  # Critical change for async
        fraction_evaluate=0.0,
        min_available_clients=1,
        initial_parameters=parameters,
    )    
    
    server = AsyncServer(
        strategy=strategy,
        client_manager=client_manager,
        async_strategy=async_strategy,
        base_conf_dict=base_conf_dict,
        total_train_time=total_train_time  # Pass parameter here
    )
    
    return ServerAppComponents(config=config,
                               server=server,
                               client_manager=client_manager)


# Create ServerApp
app = ServerApp(server_fn=server_fn)