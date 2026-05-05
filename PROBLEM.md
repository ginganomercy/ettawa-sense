kenapa compiling lama sekali, padahal buka halaman scanner doang.



forward-logs-shared.ts:95  Server  ⚠ Unsupported metadata viewport is configured in metadata export in /. Please move it to viewport export instead.
Read more: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
forward-logs-shared.ts:95 [Fast Refresh] rebuilding
forward-logs-shared.ts:95 [Fast Refresh] done in 1195ms
(index):1 The resource http://localhost:3000/_next/static/media/83afe278b6a6bb3c-s.p.0q-301v4kxxnr.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
forward-logs-shared.ts:95 [Fast Refresh] rebuilding
(index):1 The resource http://localhost:3000/_next/static/media/83afe278b6a6bb3c-s.p.0q-301v4kxxnr.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
(index):1 The resource http://localhost:3000/_next/static/media/83afe278b6a6bb3c-s.p.0q-301v4kxxnr.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
(index):1 The resource http://localhost:3000/_next/static/media/83afe278b6a6bb3c-s.p.0q-301v4kxxnr.woff2 was preloaded using link preload but not used within a few seconds from the window's load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.
﻿

1: 00007FF74CC9892B node::SetCppgcReference+19819
<--- JS stacktrace --->

 2: 00007FF74CC08868 DSA_meth_get_flags+93320
 3: 00007FF74D682C71 v8::Isolate::ReportExternalAllocationLimitReached+65        
FATAL ERROR: Zone Allocation failed - process out of memory
 4: 00007FF74D66C3C8 v8::Function::Experimental_IsNopFunction+1336
----- Native stack trace -----
 5: 00007FF74D4CDDA0 v8::Platform::SystemClockTimeMillis+659328

 6: 00007FF74D485BA3 v8::Platform::SystemClockTimeMillis+363907

 7: 00007FF74D4D7460 v8::Platform::SystemClockTimeMillis+697920

 8: 00007FF74D4CAAC0 v8::Platform::SystemClockTimeMillis+646304
#
 9: 00007FF74D4E013A v8::Platform::SystemClockTimeMillis+733978
# Fatal error in , line 0
10: 00007FF74D4E09B7 v8::Platform::SystemClockTimeMillis+736151
# Fatal process out of memory: Zone
11: 00007FF74D4E9F02 v8::Platform::SystemClockTimeMillis+774370
#
12: 00007FF74D4E9996 v8::Platform::SystemClockTimeMillis+772982
#
13: 00007FF74CF74674 CrashForExceptionInNonABICompliantCodeRange+15604
#
14: 00007FF74D1DDF7E v8::PropertyDescriptor::value+123358
#FailureMessage Object: 00000059E2FF6220
15: 00007FF74D1C1796 v8::PropertyDescriptor::value+6646
----- Native stack trace -----
16: 00007FF74D1C1C69 v8::PropertyDescriptor::value+7881

17: 00007FF74D1C2318 v8::PropertyDescriptor::value+9592
 1: 00007FF74CC9892B
18: 00007FF74D1C32AB v8::PropertyDescriptor::value+13579
 2: 00007FF74CB8CE2F
19: 00007FF74D1C2DDD v8::PropertyDescriptor::value+12349
 3: 00007FF74DAA2442
20: 00007FF74D1C27D7 v8::PropertyDescriptor::value+10807
 4: 00007FF74D66C1D3
21: 00007FF74D19E8F2 v8::CodeEvent::GetFunctionName+46994
 5: 00007FF74D14EBF4
22: 00007FF74D72DB9E v8::PropertyDescriptor::writable+650862
 6: 00007FF74DD8B408
23: 00007FF74D7992F1 v8::PropertyDescriptor::writable+1091009
 7: 00007FF74DC0AB80
24: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
 8: 00007FF74DB6A991
25: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
 9: 00007FF74DB6835C
26: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
10: 00007FF74DB63FAA
27: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
11: 00007FF74D5DA9E1
28: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
12: 00007FF74D5A7901
29: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
13: 00007FF74CB8F90D
30: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
14: 00007FF74CCEC56D
31: 00007FF74D69F140 v8::PropertyDescriptor::writable+66576
15: 00007FF74DEC5A70
32: 00007FF74D69D500 v8::PropertyDescriptor::writable+59344
16: 00007FF919F57374
33: 00007FF74D69D0FB v8::PropertyDescriptor::writable+58315
17: 00007FF91B2DCC91
34: 00007FF74D54E0D8 v8::PrimitiveArray::Length+3928
35: 00007FF74D54D9D3 v8::PrimitiveArray::Length+2131
36: 00007FF74D661EFB v8::Function::Call+571
37: 00007FF74CC27DFA node::OnFatalError+128346
38: 00007FF74CB8207E node::TriggerNodeReport+29758
39: 00007FF74CCCAEB7 node::CreateEnvironment+599
40: 00007FF74CAF654E RSA_meth_get_flags+209198
41: 00007FF74CAF1798 RSA_meth_get_flags+189304
42: 00007FF74CCEC56D uv_poll_stop+237
43: 00007FF74DEC5A70 inflateValidate+153984
44: 00007FF919F57374 BaseThreadInitThunk+20
45: 00007FF91B2DCC91 RtlUserThreadStart+33

#
# Fatal javascript OOM in MemoryChunk allocation failed during deserialization.
#



#
# Fatal error in , line 0
# Fatal process out of memory: Zone
#
#
#
#FailureMessage Object: 0000008B7B7F6120
----- Native stack trace -----

 1: 00007FF74CC9892B
 2: 00007FF74CB8CE2F 
 3: 00007FF74DAA2442 
 4: 00007FF74D66C1D3 
 5: 00007FF74D14EBF4 
 6: 00007FF74DCB18B6
 7: 00007FF74DCB200E 
 8: 00007FF74DCB7A7D 
 9: 00007FF74DCB2229 
10: 00007FF74DCB32E2 
11: 00007FF74DB63219 
12: 00007FF74DB68668 
13: 00007FF74DB63FAA 
14: 00007FF74D5DA9E1 
15: 00007FF74D5A7901 
16: 00007FF74CB8F90D 
17: 00007FF74CCEC56D 
18: 00007FF74DEC5A70 
19: 00007FF919F57374 
20: 00007FF91B2DCC91 
Terminate batch job (Y/N)? 


ini analisis secara detail