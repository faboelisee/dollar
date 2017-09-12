#!/usr/bin/env bash
set -eux
cd $(dirname $0) && cd ..
PROJECT=$(pwd)
./bin/set-version.sh
mvn -q -e -T 1C -Drat.skip -Dsource.skip=true -DgenerateReports=false -Dmaven.javadoc.skip=true  install
