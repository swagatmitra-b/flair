from typing import Dict, Optional, Tuple
from collections import OrderedDict
import argparse
import torch
import utils
import warnings
import flwr as fl
from torch.utils.data import DataLoader
from flwr_datasets import FederatedDataset
from flower_async.async_strategy import AsynchronousStrategy
from flower_async.async_client_manager import AsyncClientManager
from flower_async.async_server import AsyncServer

warnings.filterwarnings("ignore")

# custom fit metirics aggregation function 
# aggregates the weights and metrics
def fit_metrics_agg(results):
    """
    Compute weighted average of each metric.
    Args:
        results: List of tuples (num_examples: int, metrics: Dict[str, float])
    Returns:
        Dict[str, float]: aggregated metrics
    """
    total_examples = sum(n for n, _ in results)
    # Assume all metrics dicts have the same keys
    keys = results[0][1].keys()
    return {
        k: sum(n * m[k] for n, m in results) / total_examples
        for k in keys
    }

# defining the fit config here itself
def fit_config(server_round: int) -> Dict[str, int]:
    # You can vary these per round if you like:
    return {
        "batch_size": 32,
        "local_epochs": 1,
        "val_steps": 32,
    }

def get_evaluate_fn(model: torch.nn.Module, toy: bool):
    """Return evaluation function for async server-side evaluation."""
    centralized_data = utils.load_centralized_data()
    if toy:
        centralized_data = centralized_data.select(range(10))
        
    val_loader = DataLoader(centralized_data, batch_size=16)

    def evaluate(server_rounds, parameters: fl.common.NDArrays, config) -> Tuple[float, Dict[str, float]]:
        # server_rounds and config can be ignored in this async evaluation
        """Async version without round number"""
        params_dict = zip(model.state_dict().keys(), parameters)
        state_dict = OrderedDict({k: torch.tensor(v) for k, v in params_dict})
        model.load_state_dict(state_dict, strict=True)
        loss, accuracy = utils.test(model, val_loader)
        return loss, {"accuracy": accuracy}

    return evaluate

def main():
    """Async Flower server with continuous operation"""
    parser = argparse.ArgumentParser(description="Async Flower Server")
    parser.add_argument(
        "--toy",
        action="store_true",
        help="Use reduced validation set for testing",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="efficientnet",
        choices=["efficientnet", "alexnet"],
        help="Model architecture selection",
    )
    args = parser.parse_args()

    # Model setup
    if args.model == "alexnet":
        model = utils.load_alexnet(classes=10)
    else:
        model = utils.load_efficientnet(classes=10)
    
    # Convert model parameters
    model_parameters = [val.cpu().numpy() for _, val in model.state_dict().items()]
    initial_params = fl.common.ndarrays_to_parameters(model_parameters)

    # Async components
    client_manager = AsyncClientManager()
    
    async_strategy = AsynchronousStrategy(
        total_samples=50000,  # CIFAR-10 total samples
        staleness_alpha=0.5,
        fedasync_mixing_alpha=0.3,
        fedasync_a=0.5,
        num_clients=10,
        async_aggregation_strategy="fedasync",
        use_staleness=True,
        use_sample_weighing=True,
        send_gradients=False,
        server_artificial_delay=False
    )

    # Wrap in FedAvg for compatibility
    strategy = fl.server.strategy.FedAvg(
        fraction_fit=1.0,
        fraction_evaluate=0.0,  # Disable federated evaluation
        min_fit_clients=1,
        min_available_clients=1,
        initial_parameters=initial_params,
        evaluate_fn=get_evaluate_fn(model, args.toy),
        on_fit_config_fn=fit_config,
        on_evaluate_config_fn=fit_config,
        fit_metrics_aggregation_fn=fit_metrics_agg,
    )

    # Create async server
    server = AsyncServer(
        strategy=strategy,
        client_manager=client_manager,
        async_strategy=async_strategy,
        base_conf_dict={
            "client_local_delay": False,
            "dataset_seed": 42,
            "data_loading_strategy": "fixed_nr",
            "n_last_samples_for_data_loading_fit": 100,
            "is_streaming": False
        },
        total_train_time=86400  # 24 hours
    )


    # Replace the server.fit() call with:
    fl.server.start_server(
        server=server,
        server_address="0.0.0.0:8081",
        config=fl.server.ServerConfig(num_rounds=53),  # 0 = run indefinitely
        grpc_max_message_length=1024*1024*1024
    )

if __name__ == "__main__":
    main()