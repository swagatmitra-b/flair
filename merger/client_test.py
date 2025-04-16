import time
import random
from flwr.client.client import Client  # or use your existing client interface if it's different
from flwr.common import Code
from flwr.common.typing import GetParametersIns, GetParametersRes, FitIns, FitRes, EvaluateIns, EvaluateRes, DisconnectRes
from flwr.server.client_proxy import ClientProxy  # This wraps your client
from flower_async.async_client_manager import AsyncClientManager

# Simulated client that implements the Flower client interface.
class SimulatedClient(Client):
    def __init__(self, cid: str):
        self.cid = cid
        self.parameters = [1.0, 2.0, 3.0]  # Dummy parameter vector

    def get_parameters(self, ins: GetParametersIns, timeout: float = None) -> GetParametersRes:
        # Return dummy parameters
        return GetParametersRes(parameters=self.parameters)

    def fit(self, ins: FitIns, timeout: float = None) -> FitRes:
        # Simulate training time and update parameters slightly
        time.sleep(random.uniform(0.1, 0.5))
        self.parameters = [p + random.uniform(-0.1, 0.1) for p in self.parameters]
        metrics = {"t_diff": random.uniform(0.1, 0.5), "f1": random.uniform(0.5, 1.0)}
        return FitRes(parameters=self.parameters, num_examples=10, metrics=metrics, status=Code.OK)

    def evaluate(self, ins: EvaluateIns, timeout: float = None) -> EvaluateRes:
        # Simulate evaluation
        loss = random.uniform(0.1, 1.0)
        metrics = {"f1": random.uniform(0.5, 1.0)}
        return EvaluateRes(loss=loss, num_examples=10, metrics=metrics, status=Code.OK)

    def reconnect(self, ins, timeout: float = None) -> DisconnectRes:
        # Simulate disconnect or reconnection logic
        return DisconnectRes(status=Code.OK)


# Create and register simulated clients
def register_simulated_clients(client_manager: AsyncClientManager, num_clients: int = 10):
    for i in range(num_clients):
        cid = str(i)
        simulated_client = SimulatedClient(cid)
        # Wrap in a ClientProxy; note: the actual signature might differ—check your ClientProxy implementation
        client_proxy = ClientProxy(cid=cid, client=simulated_client)
        client_manager.register(client_proxy)
        print(f"Registered client {cid}")

# Example usage: instantiate the async client manager and register simulated clients.
if __name__ == "__main__":
    from flwr.client import start_client
    client_id = str(random.randint(1, 10000))
    client = SimulatedClient(client_id)
    client_manager = AsyncClientManager()
    register_simulated_clients(client_manager, num_clients=10)
