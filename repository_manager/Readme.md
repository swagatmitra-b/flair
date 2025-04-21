# Flair Overview 
Flair is a repository manager for Machine Learning models, with version control and verifiable proof of every collaborator's commit as an NFT. It is like GitHub but for ML models, designed for privacy and collaboration. People can create an ML model and train it together on their individual private datasets. 

Models are trained locally on your device, and only the updates after training (not the raw data) are shared globally and aggregated. No data ever leaves your device. Each training round is treated as a "commit," allowing you to version, undo, and track progress. You can merge updates from different datasets, making collaboration seamless while also making sure that your personal data is never shared with anyone.

Users can convert their models and commits into NFTs, ensuring complete ownership of your intellectual work. Plus, it uses zero-knowledge proofs to securely verify all updates and merges without exposing any underlying data the model was trained on. It is the ultimate home for machine learning models to evolve and improve.

Flair is explicitly designed for version control of ML models. Here's how it works, with some similarities to GitHub:

- **Local Training**: Models are trained locally on individual datasets, so the data never leaves the user's location, ensuring privacy.
- **Aggregator Updates**: Only the model updates, not the data, are sent and aggregated in the global ML model.
- **Verifiable Commits**: Every training iteration is treated like a "commit." This allows you to track changes, revert to previous versions, or monitor progress over time, much like how GitHub handles code commits.
- **Branch Merging**: Flair supports merging commits from different branches, enabling seamless integration of training results from various datasets.
- **Tokenized Models**: Models are turned into NFTs, providing a unique, tradable, and provable ownership mechanism.
- **Zero-Knowledge Proofs**: Flair uses zero-knowledge proofs to validate updates and merges, ensuring that all changes are legitimate without revealing the underlying data.

# Frameworks Supported
- PyTorch
- TensorFlow

# Models Supported
- **Deep Learning Models** including:
  - CNNs (e.g. ResNet, MobileNet, EfficientNet)
  - LSTMs/GRUs
  - Transformers (e.g. DistilBERT, GPT)
  - Autoencoders & GANs
  - GNNs
  
Support for further models is in progress. Stay Tuned for updates!

## Why Flair
Flair is blockchain-based and is designed for collaborative machine learning on highly sensitive data, like hospital patient records. It allows users to train machine learning models using their private data without sharing it with anyone. Instead, the server sends a lightweight version of the machine learning model to the user's device, where training occurs locally. Only the model updates—no actual data—are sent back to a central server for aggregation. Users can choose whether to merge or revert these updates, similar to version control on GitHub. 

Moreover because it is built on the Solana blockchain, every user is identified by his Solana wallet, ensuring transparency and complete ownership of their ML models and commits.

## Get Started
Here's how to get started: 
- First, create a new repository
- Push an untrained model to this repository.
- Next, invite your contributors to join the party, just as you do in GitHub.
- Contributors pull the model onto their system and train it locally on their individual data. A Zero Knowledge Proof is created for the trained model.
- After local training, users push their model updates (changed parameters) to the server
- The Zero Knowledge Proof is validated to ensure that the user has indeed trained the model. Then you can review these commits and choose to merge or reject them.
- Merged commits are aggregated and applied to the model. Users can then pull the latest commit and train it further.
- And the cycle continues.

Happy collaborating!


# Additional Info
## Zero Knowledge Proof in Flair
A Zero-Knowledge Proof (ZKP) lets a contributor prove that they’ve trained a machine learning model on their private data without actually revealing the data. This means updates to the global model can be verified as legit while keeping everything confidential.

Here’s how it works in Flair: When a user trains a model using its own dataset, it creates a ZKP that proves:

- The update was done correctly and follows the model’s rules.
- The training process was fair and valid.
- No one tampered with the model or injected anything suspicious.

This way, everyone in the network can trust the contributions without ever seeing the original data or model details, keeping things both private and transparent. ;)
