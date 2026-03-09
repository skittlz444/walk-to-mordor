import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/preact';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  describe('image mode (avatarId set)', () => {
    it('renders an img tag with correct src and alt', () => {
      const { container } = render(<Avatar avatarId="gandalf-grey" username="Gandalf" size={64} />);
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.getAttribute('src')).toBe('/img/avatars/gandalf-grey.webp');
      expect(img!.getAttribute('alt')).toBe('Gandalf');
    });

    it('renders circular container', () => {
      const { container } = render(<Avatar avatarId="frodo" username="Frodo" size={128} />);
      const wrapper = container.querySelector('.avatar');
      expect(wrapper).not.toBeNull();
      expect(wrapper!.style.borderRadius).toBe('50%');
      expect(wrapper!.style.width).toBe('128px');
      expect(wrapper!.style.height).toBe('128px');
    });

    it('applies size to img dimensions', () => {
      const { container } = render(<Avatar avatarId="aragorn" username="Aragorn" size={32} />);
      const img = container.querySelector('img');
      expect(img!.getAttribute('width')).toBe('32');
      expect(img!.getAttribute('height')).toBe('32');
    });
  });

  describe('initials fallback (avatarId null)', () => {
    it('renders first initial uppercase when avatarId is null', () => {
      const { container } = render(<Avatar avatarId={null} username="samwise" size={32} />);
      const div = container.querySelector('.avatar--initials');
      expect(div).not.toBeNull();
      expect(div!.textContent).toBe('S');
    });

    it('renders first initial uppercase when avatarId is undefined', () => {
      const { container } = render(<Avatar avatarId={undefined} username="legolas" size={32} />);
      const div = container.querySelector('.avatar--initials');
      expect(div).not.toBeNull();
      expect(div!.textContent).toBe('L');
    });

    it('applies deterministic HSL background color', () => {
      const { container } = render(<Avatar avatarId={null} username="frodo" size={32} />);
      const div = container.querySelector('.avatar--initials') as HTMLElement;
      // 'f' = charCode 102, (102 * 137) % 360 = 13974 % 360 = 294
      const expected = 'hsl(294, 50%, 35%)';
      expect(div.style.backgroundColor).toBe(expected);
    });

    it('produces same color for same username', () => {
      const { container: c1 } = render(<Avatar avatarId={null} username="gandalf" size={32} />);
      const { container: c2 } = render(<Avatar avatarId={null} username="gandalf" size={64} />);
      const bg1 = (c1.querySelector('.avatar--initials') as HTMLElement).style.backgroundColor;
      const bg2 = (c2.querySelector('.avatar--initials') as HTMLElement).style.backgroundColor;
      expect(bg1).toBe(bg2);
    });

    it('produces different colors for different usernames', () => {
      const { container: c1 } = render(<Avatar avatarId={null} username="aragorn" size={32} />);
      const { container: c2 } = render(<Avatar avatarId={null} username="frodo" size={32} />);
      const bg1 = (c1.querySelector('.avatar--initials') as HTMLElement).style.backgroundColor;
      const bg2 = (c2.querySelector('.avatar--initials') as HTMLElement).style.backgroundColor;
      expect(bg1).not.toBe(bg2);
    });

    it('renders white text', () => {
      const { container } = render(<Avatar avatarId={null} username="boromir" size={32} />);
      const div = container.querySelector('.avatar--initials') as HTMLElement;
      expect(div.style.color).toBe('#fff');
    });

    it('has aria-label for accessibility', () => {
      const { container } = render(<Avatar avatarId={null} username="gimli" size={32} />);
      const div = container.querySelector('.avatar--initials');
      expect(div!.getAttribute('aria-label')).toBe('gimli');
    });

    it('renders "?" when username is empty string', () => {
      const { container } = render(<Avatar avatarId={null} username="" size={32} />);
      const div = container.querySelector('.avatar--initials');
      expect(div).not.toBeNull();
      expect(div!.textContent).toBe('?');
    });

    it('applies deterministic background color for empty username using "?" fallback', () => {
      const { container } = render(<Avatar avatarId={null} username="" size={32} />);
      const div = container.querySelector('.avatar--initials') as HTMLElement;
      // '?' = charCode 63, (63 * 137) % 360 = 8631 % 360 = 351
      const expected = 'hsl(351, 50%, 35%)';
      expect(div.style.backgroundColor).toBe(expected);
    });

    it('handles unicode/emoji first character (charAt gives first code unit)', () => {
      const { container } = render(<Avatar avatarId={null} username="🧙wizard" size={32} />);
      const div = container.querySelector('.avatar--initials');
      expect(div).not.toBeNull();
      // charAt(0) returns the high surrogate of the emoji — this is expected behavior
      // The component renders whatever charAt(0) returns
      expect(div!.textContent).toBeTruthy();
      expect(div!.textContent!.length).toBe(1);
    });

    it('handles accented characters', () => {
      const { container } = render(<Avatar avatarId={null} username="éowyn" size={32} />);
      const div = container.querySelector('.avatar--initials');
      expect(div).not.toBeNull();
      expect(div!.textContent).toBe('É');
    });

    it('handles very long username (only shows first char)', () => {
      const longName = 'a'.repeat(200);
      const { container } = render(<Avatar avatarId={null} username={longName} size={32} />);
      const div = container.querySelector('.avatar--initials');
      expect(div!.textContent).toBe('A');
    });
  });

  describe('size variations', () => {
    it.each([24, 32, 64, 128])('renders correctly at %dpx (image mode)', (size) => {
      const { container } = render(<Avatar avatarId="frodo" username="Frodo" size={size} />);
      const wrapper = container.querySelector('.avatar');
      expect(wrapper!.style.width).toBe(`${size}px`);
      expect(wrapper!.style.height).toBe(`${size}px`);
    });

    it.each([24, 32, 64, 128])('renders correctly at %dpx (initials mode)', (size) => {
      const { container } = render(<Avatar avatarId={null} username="Frodo" size={size} />);
      const div = container.querySelector('.avatar--initials');
      expect(div!.style.width).toBe(`${size}px`);
      expect(div!.style.height).toBe(`${size}px`);
    });

    it('uses smaller font for 24px', () => {
      const { container } = render(<Avatar avatarId={null} username="test" size={24} />);
      const div = container.querySelector('.avatar--initials') as HTMLElement;
      expect(div.style.fontSize).toBe('0.65rem');
    });

    it('uses medium font for 32px', () => {
      const { container } = render(<Avatar avatarId={null} username="test" size={32} />);
      const div = container.querySelector('.avatar--initials') as HTMLElement;
      expect(div.style.fontSize).toBe('0.85rem');
    });

    it('uses larger font for 64px', () => {
      const { container } = render(<Avatar avatarId={null} username="test" size={64} />);
      const div = container.querySelector('.avatar--initials') as HTMLElement;
      expect(div.style.fontSize).toBe('1.5rem');
    });

    it('uses largest font for 128px', () => {
      const { container } = render(<Avatar avatarId={null} username="test" size={128} />);
      const div = container.querySelector('.avatar--initials') as HTMLElement;
      expect(div.style.fontSize).toBe('3rem');
    });
  });
});
