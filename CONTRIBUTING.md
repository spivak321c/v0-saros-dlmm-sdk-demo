# Contributing to Saros DLMM Rebalancer

Thank you for your interest in contributing! This project is open source and welcomes contributions.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/saros-dlmm-rebalancer.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test thoroughly
6. Commit: `git commit -m "Add your feature"`
7. Push: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

### Testing

- Test on devnet before submitting
- Add unit tests for new utilities
- Verify Telegram bot commands work
- Check dashboard renders correctly

### Documentation

- Update README for new features
- Add JSDoc comments to functions
- Update SETUP.md if setup changes
- Include examples in code

## Areas for Contribution

### High Priority

- [ ] Add unit tests for calculation utilities
- [ ] Implement actual DLMM SDK integration (replace mocks)
- [ ] Add more pool support
- [ ] Improve error handling
- [ ] Add retry logic for failed transactions

### Features

- [ ] Multi-user support
- [ ] Advanced backtesting with real historical data
- [ ] AI-based volatility prediction
- [ ] Discord bot integration
- [ ] Mobile app
- [ ] Email notifications
- [ ] Custom rebalancing strategies

### Improvements

- [ ] Better gas optimization
- [ ] More sophisticated IL calculations
- [ ] Enhanced portfolio analytics
- [ ] Real-time price feeds
- [ ] Transaction history tracking

## Pull Request Process

1. Ensure code follows style guidelines
2. Update documentation
3. Add tests if applicable
4. Ensure all tests pass
5. Update CHANGELOG.md
6. Request review from maintainers

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn
- Focus on the code, not the person

## Questions?

Open an issue or reach out to maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
