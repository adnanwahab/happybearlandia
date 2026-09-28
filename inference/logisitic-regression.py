import torch
import torch.nn as nn
import torch.optim as optim


class LogisticRegression(nn.Module):
    """Simple binary logistic regression model."""

    def __init__(self, input_dim: int):
        super().__init__()
        self.linear = nn.Linear(input_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Return logits; apply sigmoid only for probabilities/inference.
        return self.linear(x)


if __name__ == "__main__":
    torch.manual_seed(42)

    # Dummy data: 100 samples, 3 features
    X = torch.randn(100, 3)
    true_w = torch.tensor([[1.5], [-2.0], [0.7]])
    true_b = 0.2

    # Generate labels from a logistic process
    logits = X @ true_w + true_b
    probs = torch.sigmoid(logits)
    y = (probs > 0.5).float()

    model = LogisticRegression(input_dim=3)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.SGD(model.parameters(), lr=0.1)

    # Train
    epochs = 200
    for epoch in range(epochs):
        optimizer.zero_grad()
        pred_logits = model(X)
        loss = criterion(pred_logits, y)
        loss.backward()
        optimizer.step()

        if (epoch + 1) % 50 == 0:
            print(f"Epoch [{epoch + 1}/{epochs}] - Loss: {loss.item():.4f}")

    # Inference example
    with torch.no_grad():
        sample = torch.tensor([[0.3, -1.2, 0.8]])
        sample_logit = model(sample)
        sample_prob = torch.sigmoid(sample_logit)
        pred_class = (sample_prob >= 0.5).float()

        print("\nSample probability:", sample_prob.item())
        print("Predicted class:", int(pred_class.item()))
