For details about running kafka in docker-compose, see https://github.com/wurstmeister/kafka-docker. I also
found some useful notes at http://www.smartjava.org/content/setting-up-kafka-cluster-docker-copy/

docker-compose.yaml needs to have an address that will be valid both inside and outside of the container
for KAFKA_ADVERTISED_HOST_NAME.  Best to use a hostname that is pointing to the local ip address 
(but not localhost or 127.0.0.1, since those won't resolve correctly within the container unless the port 
number is the same both inside and out). 

Repo uses direnv to automatically set environment vars when entering the directory.  Installation
instructions are here: https://direnv.net/docs/hook.html

Kafka clients intended to be built around node-rdkafka: https://github.com/Blizzard/node-rdkafka
Some notes about kafka use in node/typescript are here:
https://rclayton.silvrback.com/thoughts-on-node-rdkafka-development

Project used google GTS to initialize all of the typescript ecosystem: https://github.com/google/gts

I added mocha-based unit tests, largely because jest required a bunch of deprecated packages,
which annoyed me.

to run kafkacat as a producer against the docker-compose cluster:
```
docker run --interactive --rm \
        confluentinc/cp-kafkacat \
        kafkacat -b 192.168.1.6:9092 \
                -t test \
                -K: \
                -P <<EOF

1:{"order_id":1,"order_ts":1534772501276,"total_amount":10.50,"customer_name":"Bob Smith"}
1:{"order_id":4,"order_ts":1534772501276,"total_amount":10.51,"customer_name":"Bob Smith2"}
1:{"order_id":5,"order_ts":1534772501276,"total_amount":10.52,"customer_name":"Bob Smith3"}
2:{"order_id":2,"order_ts":1534772605276,"total_amount":3.32,"customer_name":"Sarah Black"}
3:{"order_id":3,"order_ts":1534772742276,"total_amount":21.00,"customer_name":"Emma Turner"}
EOF
```

to run kafkacat as a consumer against the docker-compose cluster:
```
docker run --tty --interactive --rm \
           confluentinc/cp-kafkacat \
           kafkacat -b 192.168.1.6:9092 \
           -C \
           -f '\nKey (%K bytes): %k\t\nValue (%S bytes): %s\n\Partition: %p\tOffset: %o\n--\n' \
           -t test
```
