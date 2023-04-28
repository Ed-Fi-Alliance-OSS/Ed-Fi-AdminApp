import { faker } from '@faker-js/faker';
import { FakeMeUsing, generateFake } from './entity-generator';

const dateVal = new Date();
class TestParent {
  @FakeMeUsing('some value')
  staticValue: string;

  @FakeMeUsing(() => faker.helpers.arrayElement(['single array value']))
  fakerValue: string;

  @FakeMeUsing(dateVal)
  dateValue: Date;
}

class TestChild extends TestParent {
  @FakeMeUsing('new value')
  newValue: string;
}

class TestChildOverride extends TestChild {
  @FakeMeUsing('some new value')
  override staticValue: string;
}

describe('entity-generator', () => {
  it('should generate single and multiple', () => {
    const single = generateFake(TestParent);
    expect(Array.isArray(single)).toEqual(false);

    const multiple = generateFake(TestParent, undefined, 2);

    expect(Array.isArray(multiple)).toEqual(true);
    expect(multiple.length).toEqual(2);
  });
  it('should use runtime overrides correctly', () => {
    const single = generateFake(TestParent, () => ({
      staticValue: 'some other value',
    }));
    expect(single).toEqual({
      staticValue: 'some other value',
      fakerValue: 'single array value',
      dateValue: dateVal,
    });
  });
  it('should work with new properties of inherited classes', () => {
    const inherited = generateFake(TestChild);
    expect(inherited).toEqual({
      staticValue: 'some value',
      fakerValue: 'single array value',
      dateValue: dateVal,
      newValue: 'new value',
    });
  });
  it('should work with override properties of inherited classes', () => {
    const inherited = generateFake(TestChildOverride);
    expect(inherited).toEqual({
      staticValue: 'some new value',
      fakerValue: 'single array value',
      dateValue: dateVal,
      newValue: 'new value',
    });
  });
  it('should work with class-level config', () => {
    @FakeMeUsing({ otherValue: 'other value', otherOtherValue: 'other other value' })
    class ClassLevel {
      @FakeMeUsing('some value')
      staticValue: string;

      otherValue: string;
      otherOtherValue: string;
    }

    const classLevel = generateFake(ClassLevel);
    expect(classLevel).toEqual({
      staticValue: 'some value',
      otherValue: 'other value',
      otherOtherValue: 'other other value',
    });
  });
});
