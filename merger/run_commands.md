# start a flower superlink

sudo flower-superlink --insecure

# start the server app

flwr-serverapp --insecure  --serverappio-api-address 127.0.0.1:9091

# start a flower supernode

flower-supernode --insecure --superlink 127.0.0.1:9092 --clientappio-api-address 127.0.0.1:9094 --node-config "partition-id=0 num-partitions=2"


# start the flower app

flwr-clientapp --insecure --clientappio-api-address 127.0.0.1:9094