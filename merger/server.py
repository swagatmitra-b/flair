# Aggregating server implementation Federated Averaging
# Authors: Debashish Buragohain, Swagatmitra Bhattacharya

from flower_async.async_strategy import AsynchronousStrategy
from flower_async.async_server import AsyncServer
from flower_async.async_client_manager import AsyncClientManager

server = AsyncServer(
    strategy=FedAvg(<customized>), 
    client_manager=AsyncClientManager(), 
    async_strategy=AsynchronousStrategy(<customized>))