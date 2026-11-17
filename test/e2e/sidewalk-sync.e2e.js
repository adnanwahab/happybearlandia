import {test} from '@playwright/test';
import {assertSidewalkAcceptance} from '../support/sidewalk-acceptance.js';

test('mapped sidewalk body stays visible, selectable and synchronized',assertSidewalkAcceptance);
