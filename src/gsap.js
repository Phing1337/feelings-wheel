/* GSAP + plugins, exposed as globals so the engine files can stay framework-free. */
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(Draggable, InertiaPlugin, MotionPathPlugin, SplitText);
Object.assign(window, { gsap, Draggable, InertiaPlugin, MotionPathPlugin, SplitText });
