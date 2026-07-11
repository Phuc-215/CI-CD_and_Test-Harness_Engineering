import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

describe('App smoke test', () => {
  it('renders without crashing', () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve([]),
      })
    );

    const { getByText, queryByText } = render(<App />);
    
    // Smoke check: check if it doesn't crash.
    expect(global.fetch).toHaveBeenCalled();
  });
});
