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

package me.neilellis.dollar.relproxy.impl.jproxy.core;

import me.neilellis.dollar.relproxy.impl.GenericProxyImpl;
import me.neilellis.dollar.relproxy.impl.GenericProxyInvocationHandler;
import me.neilellis.dollar.relproxy.impl.jproxy.JProxyConfigImpl;
import me.neilellis.dollar.relproxy.impl.jproxy.core.clsmgr.ClassDescriptorSourceScript;
import me.neilellis.dollar.relproxy.impl.jproxy.core.clsmgr.JProxyEngine;
import me.neilellis.dollar.relproxy.impl.jproxy.core.clsmgr.SourceScript;
import me.neilellis.dollar.relproxy.jproxy.JProxyDiagnosticsListener;
import org.jetbrains.annotations.NotNull;

/**
 * @author jmarranz
 */
public abstract class JProxyImpl extends GenericProxyImpl {
    public static JProxyImpl SINGLETON;
    protected JProxyEngine engine;

    protected JProxyImpl() {
    }

    @NotNull @Override
    public <T> GenericProxyInvocationHandler<T> createGenericProxyInvocationHandler(T obj) {
        return new JProxyInvocationHandler<>(obj, this);
    }

    public JProxyEngine getJProxyEngine() {
        return engine;
    }

    public abstract Class getMainParamClass();

    public ClassDescriptorSourceScript init(@NotNull JProxyConfigImpl config, SourceScript scriptFile,
                                            ClassLoader classLoader) {
        super.init(config);

        String inputPath = config.getInputPath();
        String classFolder = config.getClassFolder();
        long scanPeriod = config.getScanPeriod();
        Iterable<String> compilationOptions = config.getCompilationOptions();
        JProxyDiagnosticsListener diagnosticsListener = config.getJProxyDiagnosticsListener();

        classLoader = classLoader != null ? classLoader : getDefaultClassLoader();
        this.engine =
                new JProxyEngine(this, scriptFile, classLoader, inputPath, classFolder, scanPeriod, compilationOptions,
                                 diagnosticsListener);
        return engine.init();
    }

    public static ClassLoader getDefaultClassLoader() {
        return Thread.currentThread().getContextClassLoader();
    }

    public boolean start() {
        return engine.start();
    }

    public boolean stop() {
        return engine.stop();
    }
}
