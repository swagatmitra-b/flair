# simulated_client.py

import time
import random
from flwr.client.client import Client
from flwr.common import Code
from flwr.common.typing import GetParametersIns, GetParametersRes, FitIns, FitRes, EvaluateIns, EvaluateRes, DisconnectRes

class SimulatedClient(Client):
    def __init__(self, cid: str):
        self.cid = cid
        self.parameters = [1.0, 2.0, 3.0]  # Dummy initial parameters

    def get_parameters(self, ins: GetParametersIns, timeout: float = None) -> GetParametersRes:
        # Return the current parameters
        return GetParametersRes(parameters=self.parameters)

    def fit(self, ins: FitIns, timeout: float = None) -> FitRes:
        # Simulate local training by sleeping for a short random duration
        time.sleep(random.uniform(0.1, 0.5))
        # Update parameters slightly as a dummy training step
        self.parameters = [p + random.uniform(-0.1, 0.1) for p in self.parameters]
        metrics = {"t_diff": random.uniform(0.1, 0.5), "f1": random.uniform(0.5, 1.0)}
        return FitRes(parameters=self.parameters, num_examples=10, metrics=metrics, status=Code.OK)

    def evaluate(self, ins: EvaluateIns, timeout: float = None) -> EvaluateRes:
        # Simulate evaluation
        loss = random.uniform(0.1, 1.0)
        metrics = {"f1": random.uniform(0.5, 1.0)}
        return EvaluateRes(loss=loss, num_examples=10, metrics=metrics, status=Code.OK)

    def reconnect(self, ins, timeout: float = None) -> DisconnectRes:
        # Simulate reconnection if needed
        return DisconnectRes(status=Code.OK)
