import { useSignal } from '@preact/signals';

export function HelloWorld() {
  const count = useSignal(0);
  const isToggled = useSignal(false);

  return (
    <div style={{
      padding: '20px',
      border: '2px solid #646cff',
      borderRadius: '8px',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      maxWidth: '400px',
    }}>
      <h2 style={{ margin: '0 0 16px 0' }}>
        🎉 Preact Island: HelloWorld
      </h2>
      
      <p style={{ marginBottom: '16px' }}>
        This is a proof-of-concept Preact island using Signals for state management.
      </p>

      {/* Counter Demo */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#242424',
        borderRadius: '4px',
      }}>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>Counter Signal:</strong> {count.value}
        </p>
        <button
          onClick={() => count.value++}
          style={{
            padding: '8px 16px',
            marginRight: '8px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #646cff',
            backgroundColor: '#646cff',
            color: 'white',
            fontWeight: '500',
          }}
        >
          Increment
        </button>
        <button
          onClick={() => count.value = 0}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #555',
            backgroundColor: '#333',
            color: 'white',
            fontWeight: '500',
          }}
        >
          Reset
        </button>
      </div>

      {/* Toggle Demo */}
      <div style={{ 
        padding: '12px',
        backgroundColor: '#242424',
        borderRadius: '4px',
      }}>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>Toggle Signal:</strong> {isToggled.value ? '✅ ON' : '❌ OFF'}
        </p>
        <button
          onClick={() => isToggled.value = !isToggled.value}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #646cff',
            backgroundColor: isToggled.value ? '#4caf50' : '#646cff',
            color: 'white',
            fontWeight: '500',
          }}
        >
          Toggle
        </button>
      </div>
    </div>
  );
}
