/*
 * Copyright (c) 2014-2015 Neil Ellis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package me.neilellis.dollar.relproxy.impl.jproxy.core.clsmgr;

import me.neilellis.dollar.relproxy.impl.jproxy.JProxyUtil;

import java.io.File;

/**
 * @author jmarranz
 */
public class SourceScriptFileJavaExt extends SourceScriptFile {
    public SourceScriptFileJavaExt(File sourceFile) {
        super(sourceFile);
    }

    @Override
    public String getScriptCode(String encoding, boolean[] hasHashBang) {
        hasHashBang[0] = false;
        return JProxyUtil.readTextFile(sourceFile, encoding);
    }
}
