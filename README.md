net-mapper
====================

Construct maps and graph of large ISPs through reverse DNS records.

## Working Principle

Most large scale ISPs label their routing interface IPs with reverse DNS names for easier maintenance and other reasons. By exploiting the structured naming mechanism that exists for these IPs, we can reconstruct the data by scanning all of the reverse DNS records and perform analysis to reconstruct links.

## Usage

Run the scanner first, then run the mapper to generate graph and map files.

```
node scanner.js
node mapper.js
```
For the details, please read the code. I'm trying to document everything slowly.

## Unimplemented Features

1. Perform ping test to see if the link actually exists
2. Generalize the code and add templates to adapt the scanner/mapper work with different ISPs' naming convention

