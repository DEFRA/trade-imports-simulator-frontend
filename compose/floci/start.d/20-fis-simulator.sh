#!/bin/bash

# trade-imports-fis-simulator-api publishes every IUU notification it creates or updates to this
# topic. The queue is subscribed to it so published messages can be read back:
#   aws --endpoint-url=http://localhost:4566 sqs receive-message \
#     --queue-url http://localhost:4566/000000000000/trade_imports_iuunotification_sim_upserted_queue \
#     --message-attribute-names All

set -e

TOPIC_NAME="trade_imports_iuunotification_sim_upserted"
QUEUE_NAME="trade_imports_iuunotification_sim_upserted_queue"

aws sns create-topic --name "$TOPIC_NAME"
aws sqs create-queue --queue-name "$QUEUE_NAME"
aws sns subscribe \
  --topic-arn "arn:aws:sns:eu-west-2:000000000000:$TOPIC_NAME" \
  --protocol sqs \
  --notification-endpoint "arn:aws:sqs:eu-west-2:000000000000:$QUEUE_NAME" \
  --attributes '{"RawMessageDelivery": "true"}'
