#!/bin/sh
trim() {
  echo $1 | sed 's/^[ ]*//g' | sed 's/^[ ]*//g'
  return 1
}

test_hosts() {
  set -f;
  IFS=','

  for el in $WAIT_HOSTS;
  do
    if ! nc -zv "$(trim $(echo $el | cut -d':' -f1))" "$(trim $(echo $el | cut -d':' -f2))";
    then
      return 1;
    fi
  done
  unset IFS
  set +f;
}
sleep ${WAIT_BEFORE_HOSTS:-0}

start_time=$(date +%s)
while ! test_hosts;
do
  if [ $(($(date +%s) - $start_time)) -gt ${WAIT_HOSTS_TIMEOUT:-30} ];
  then
    echo "Timeout waiting for hosts";
    exit 1
  fi
  sleep ${WAIT_SLEEP_INTERVAL:-1}
done

sleep ${WAIT_AFTER_HOSTS:-0}
