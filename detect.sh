#!/bin/sh
time=$(date "+%Y%-m%d")
mkdir -p $time
cd $time

git clone $1 target
cd target
yarn install

git fetch origin $2:$2
git checkout $2

git diff master..$2 --unified=0 --output=git_diff.txt
cd ..
git clone $1 source
