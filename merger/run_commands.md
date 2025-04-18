flower-superlink --insecure
<!-- By default, it binds to 0.0.0.0:9092 (Fleet API) and 0.0.0.0:9093 (ServerAppIo API). -->

# client 1
<!-- 
flower-supernode spins up a SuperNode (client) that connects to your SuperLink’s Fleet API.
--superlink 127.0.0.1:9092 points the client at your running SuperLink.
--clientappio-api-address 127.0.0.1:9094 is where this SuperNode listens for its ClientApp.
--node-config passes key–value pairs into your ClientApp via its Context (e.g. for local data partitioning). 
flower.ai 
-->


flower-supernode --insecure --superlink 127.0.0.1:9092 --clientappio-api-address 127.0.0.1:9094 --node-config "partition-id=0 num-partitions=2"


# client 2
flower-supernode --insecure --superlink 127.0.0.1:9092 --clientappio-api-address 127.0.0.1:9095 --node-config "partition-id=1 num-partitions=2"